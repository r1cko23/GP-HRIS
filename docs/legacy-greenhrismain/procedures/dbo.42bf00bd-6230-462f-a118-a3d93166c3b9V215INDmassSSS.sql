CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmassSSS]
    @idclient VARCHAR(20),
    @PayrollPeriodStart DATE
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @employee_id INT

        -- ============================================
        -- EMPLOYEE CURSOR
        -- ============================================
        DECLARE emp_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT employee_id
        FROM payroll_summary
        WHERE idclientp = @idclient
        AND Date_Start = @PayrollPeriodStart

        OPEN emp_cursor
        FETCH NEXT FROM emp_cursor INTO @employee_id

        WHILE @@FETCH_STATUS = 0
        BEGIN

            DECLARE 
                @idpayroll0 INT,
                @sssbasis NVARCHAR(20),
                @grossamt FLOAT,
                @basicamt FLOAT,
                @otherbasisamt FLOAT,
                @withsss NVARCHAR(5)

            -- ========================================
            -- PAYROLL CURSOR (ORDERED)
            -- ========================================
            DECLARE payroll_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT idpayrollsum, sssbasis, grossalary, basic, othermandatorybasis, withsss
            FROM payroll_summary
            WHERE employee_id = @employee_id
            AND idclientp = @idclient
            AND Date_Start = @PayrollPeriodStart
            ORDER BY idpayrollsum

            OPEN payroll_cursor
            FETCH NEXT FROM payroll_cursor 
            INTO @idpayroll0, @sssbasis, @grossamt, @basicamt, @otherbasisamt, @withsss

            WHILE @@FETCH_STATUS = 0
            BEGIN

                DECLARE 
                    @prevGross FLOAT = 0,
                    @prevBasic FLOAT = 0,
                    @prevOther FLOAT = 0,
                    @prevEE FLOAT = 0,
                    @prevER FLOAT = 0,
                    @prevECC FLOAT = 0

                -- PREVIOUS VALUES
                SELECT 
                    @prevGross = ISNULL(SUM(grossamttaxable),0),
                    @prevBasic = ISNULL(SUM(basic),0),
                    @prevOther = ISNULL(SUM(othermandatorybasis),0),
                    @prevEE = ISNULL(SUM(contributionSSSEE),0),
                    @prevER = ISNULL(SUM(contributionSSSER),0),
                    @prevECC = ISNULL(SUM(contributionSSSECC),0)
                FROM payroll_summary
                WHERE employee_id = @employee_id
                AND idclientp = @idclient
                AND Date_Start = @PayrollPeriodStart
                AND idpayrollsum < @idpayroll0

                -- OTHER INCOME
                DECLARE @otherincome FLOAT = 0

                SELECT @otherincome = ISNULL(SUM(A.amount),0)
                FROM adjustment A
                INNER JOIN IncomeClass I ON A.codeadjustment = I.codeadjustment
                WHERE A.employee_id = @employee_id
                AND A.idclientincome = @idclient
                AND A.Date_Start = @PayrollPeriodStart
                AND A.idpayrollsum = @idpayroll0
                AND I.taxableincome = 'False'

                -- TOTALS
                DECLARE 
                    @forssstotalgross2 FLOAT = @grossamt + @prevGross - @otherincome,
                    @forssstotalbasic2 FLOAT = @basicamt + @prevBasic,
                    @forssstotalotherbasis2 FLOAT = @otherbasisamt + @prevOther

                -- SSS LOOKUP
                DECLARE 
                    @ssseegross FLOAT = 0, @sssergross FLOAT = 0, @ssseccgross FLOAT = 0,
                    @ssseebasic FLOAT = 0, @ssserbasic FLOAT = 0, @ssseccbasic FLOAT = 0,
                    @ssseeotherbasis FLOAT = 0, @ssserotherbasis FLOAT = 0, @ssseccotherbasis FLOAT = 0

                SELECT TOP 1 
                    @ssseegross=EmployeeSSS,
                    @sssergross=EmployerSSS,
                    @ssseccgross=EmployerECC
                FROM SSS 
                WHERE Range <= @forssstotalgross2 
                ORDER BY Range DESC

                SELECT TOP 1 
                    @ssseebasic=EmployeeSSS,
                    @ssserbasic=EmployerSSS,
                    @ssseccbasic=EmployerECC
                FROM SSS 
                WHERE Range <= @forssstotalbasic2 
                ORDER BY Range DESC

                SELECT TOP 1 
                    @ssseeotherbasis=EmployeeSSS,
                    @ssserotherbasis=EmployerSSS,
                    @ssseccotherbasis=EmployerECC
                FROM SSS 
                WHERE Range <= @forssstotalotherbasis2 
                ORDER BY Range DESC

                -- FINAL COMPUTATION
                DECLARE 
                    @finalEE FLOAT = 0,
                    @finalER FLOAT = 0,
                    @finalECC FLOAT = 0

                IF @withsss = 'Y'
                BEGIN
                    IF @sssbasis = 'gross'
                    BEGIN
                        SET @finalEE = CASE WHEN @forssstotalgross2 <= 1000 THEN 0 ELSE @ssseegross - @prevEE END
                        SET @finalER = CASE WHEN @forssstotalgross2 <= 1000 THEN 0 ELSE @sssergross - @prevER END
                        SET @finalECC = CASE WHEN @forssstotalgross2 <= 1000 THEN 0 ELSE @ssseccgross - @prevECC END
                    END

                    ELSE IF @sssbasis = 'basic'
                    BEGIN
                        SET @finalEE = CASE WHEN @forssstotalbasic2 <= 1000 THEN 0 ELSE @ssseebasic - @prevEE END
                        SET @finalER = CASE WHEN @forssstotalbasic2 <= 1000 THEN 0 ELSE @ssserbasic - @prevER END
                        SET @finalECC = CASE WHEN @forssstotalbasic2 <= 1000 THEN 0 ELSE @ssseccbasic - @prevECC END
                    END

                    ELSE IF @sssbasis = 'others'
                    BEGIN
                        SET @finalEE = CASE WHEN @forssstotalotherbasis2 <= 1000 THEN 0 ELSE @ssseeotherbasis - @prevEE END
                        SET @finalER = CASE WHEN @forssstotalotherbasis2 <= 1000 THEN 0 ELSE @ssserotherbasis - @prevER END
                        SET @finalECC = CASE WHEN @forssstotalotherbasis2 <= 1000 THEN 0 ELSE @ssseccotherbasis - @prevECC END
                    END
                END

                -- UPDATE
                UPDATE payroll_summary
                SET 
                    contributionSSSEE = @finalEE,
                    contributionSSSER = @finalER,
                    contributionSSSECC = @finalECC
                WHERE idpayrollsum = @idpayroll0
                AND trxtypep = 'Normal'

                FETCH NEXT FROM payroll_cursor 
                INTO @idpayroll0, @sssbasis, @grossamt, @basicamt, @otherbasisamt, @withsss
            END

            CLOSE payroll_cursor
            DEALLOCATE payroll_cursor

            FETCH NEXT FROM emp_cursor INTO @employee_id
        END

        CLOSE emp_cursor
        DEALLOCATE emp_cursor

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Return error (important for debugging)
        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE()
        DECLARE @ErrorLine INT = ERROR_LINE()

        RAISERROR('SP FAILED: %s (Line %d)',16,1,@ErrorMessage,@ErrorLine)
    END CATCH
END