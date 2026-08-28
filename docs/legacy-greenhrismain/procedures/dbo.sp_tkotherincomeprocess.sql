
-- =============================================
-- Author:      Pat Relos
-- Create date: 1/8/2026 05:00 PM
-- Description: Process of other income from template base to payroll 
-- =============================================
create PROCEDURE [dbo].[sp_tkotherincomeprocess] 
(
    @idemployee       INT,
    @idclient          INT,
    @iddepartment      INT,
    @datestart         DATE, 
    @dateend           DATE
    --@allowance		DECIMAL(18,2) 
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @idpayrollsum       INT;
    DECLARE @countincomep   INT = 0;
    DECLARE @countdeductiontk  INT = 0;

    ---------------------------------------------------
    -- Get payroll summary id
    ---------------------------------------------------
    --SELECT TOP (1)  
    --    @idpayrollsum = idpayrollsum
    --FROM payroll_summary
    --WHERE employee_id = @idemployee 
    --  AND idclientp   = @idclient 
    --  AND date_start  = @datestart
    --ORDER BY grossalary DESC;   -- ✔️ make sure column name is correct

    ---------------------------------------------------
    -- Count employee with allowance from timekeep
    ---------------------------------------------------
    --SELECT 
    --    @countdeductiontk = COUNT(*)
    --FROM tbl_timekeep
    --WHERE employeeid     = @idemployee 
    --  AND idclient        = @idclient 
    --  AND datestart       = @datestart
    --  AND ISNULL(allowance, 0) <> 0;

    ---------------------------------------------------
    -- Count existing income in payroll
    ---------------------------------------------------
    --SELECT 
    --    @countincomep = COUNT(*)
    --FROM adjustment
    --WHERE employee_id        = @idemployee 
    --  AND idclientincome =   @idclient 
    --  AND date_start         = @datestart;

    ---------------------------------------------------
    -- Transaction
    ---------------------------------------------------
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validate payroll summary exists if there is deduction
        IF @countdeductiontk > 0 AND @idpayrollsum IS NULL
        BEGIN
            RAISERROR('Payroll summary not found for this employee.', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- Insert only if no existing deduction yet
    --    IF @countincomep = 0 AND @totalotherincome <> 0
    --    BEGIN
    --        INSERT INTO adjustment
    --        (
    --            idpayrollsum,
    --            employee_id,
    --            date_start,
    --            date_end,
    --            idclientincome,
    --            iddepartmentincome,
    --            amount,
				--amounttaxable,
				--codeadjustment,
				--particular
				
    --        )
    --        VALUES
    --        (
    --            @idpayrollsum,
    --            @idemployee,
    --            @datestart,
    --            @dateend,
    --            @idclient,
    --            @iddepartment,
    --            @totalotherincome,
				--0,
				--50.18,
				--'Allowance'
    --        );
    --    END

		--update gross salary

		--update payroll_summary
		--set Adjustment= @totalotherincome ,grossalary = @totalotherincome+TotalOT+basic	  
		--where idpayrollsum = @idpayrollsum

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000),
                @ErrorSeverity INT,
                @ErrorState INT;

        SELECT 
            @ErrorMessage = ERROR_MESSAGE(),
            @ErrorSeverity = ERROR_SEVERITY(),
            @ErrorState = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END
