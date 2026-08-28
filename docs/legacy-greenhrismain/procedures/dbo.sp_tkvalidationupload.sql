
create PROCEDURE [dbo].[sp_tkvalidationupload] 
(
  
    @datestart  DATE,
	@idclient int,
	@iddepgroup int,
	@uname  nvarchar(50), 
	@dateupload  nvarchar(50)

)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @countempid1 INT;
		DECLARE @countempname1 INT;
		DECLARE @fname1 nvarchar(50);  
		DECLARE @lname1 nvarchar(50);  
        DECLARE @countempidemp1 INT
		DECLARE @countjobcode1 INT;
		DECLARE @countidclient1 INT;;
        DECLARE @employeeid1 INT;
        DECLARE @idclient1 INT;
		DECLARE @iddepgroup1 INT;
		DECLARE @idcountgroupdep1 INT;
		DECLARE @idcountgroupdepmismatch1 INT;
		DECLARE @idcountgroupbarrow INT;
        DECLARE @jobcode1 INT;
        DECLARE @idtimekeeptemp1 INT;

				 update tbl_timekeeptemp
set statustemp = 'Ok'
		
		DECLARE myCursor1 CURSOR FOR

		 		

            -- open timekeeptemp    
            SELECT  idtimekeeptemp, employeeid, idclient, idposition, fname2, lname2,departmentcode
            FROM tbl_timekeeptemp 
            Where  DateStart = @datestart and username = @uname
            ORDER BY idtimekeeptemp;

        OPEN myCursor1;

        FETCH NEXT FROM myCursor1 
        INTO @idtimekeeptemp1, @employeeid1, @idclient1, @jobcode1, @fname1,@lname1,@iddepgroup1

        WHILE @@FETCH_STATUS = 0
        BEGIN 
				 

            ---------------------------------------------------
            -- Check if Employee ID exists
            ---------------------------------------------------
            SET @countempid1 = NULL;   

            SELECT TOP 1 
                @countempid1 = Employee_id
            FROM Employee 
            WHERE Employee_id = @employeeid1;
            
            IF @countempid1 IS NULL                              
            BEGIN
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Invalid Employee ID'
                        ELSE statustemp + ' | Invalid Employee ID'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END


			  ---------------------------------------------------
            -- Check if Employee Name Match exists
            ---------------------------------------------------
            SET @countempname1 = NULL;   

            SELECT TOP 1 
                @countempname1 = Employee_id
            FROM Employee 
            WHERE Employee_id = @employeeid1 and fname = @fname1 and lname = @lname1;
            
            IF @countempname1 IS NULL                              
            BEGIN
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Name Mismatch'
                        ELSE statustemp + ' | Name Mismatch'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END




            ---------------------------------------------------
            -- Check if Job Code exists
            ---------------------------------------------------
            SET @countjobcode1 = NULL;   

            SELECT TOP 1 
                @countjobcode1 = idbranchposition
            FROM client_branch_position 
            WHERE idbranchposition = @jobcode1 and idclient = @idclient1;
            
            IF @countjobcode1 IS NULL                              
            BEGIN
		
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Invalid Job Code'
                        ELSE statustemp + ' | Invalid Job Code'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END



			---------------------------------------------------
            -- Check if client ID exist
            ---------------------------------------------------
            SET @countidclient1 = NULL;   

            SELECT TOP 1 
                @countidclient1 = idclient
            FROM client 
            WHERE idclient = @idclient1;
            
            IF @countidclient1 IS NULL                              
            BEGIN
		
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Invalid ID Client'
                        ELSE statustemp + ' | Invalid ID Client'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END

	

			---------------------------------------------------
            --check groupname/department id exist	 
            ---------------------------------------------------
            SET @idcountgroupdep1= NULL;   

            SELECT TOP 1 
            @idcountgroupdep1 = iddepartment
            FROM Department 
            WHERE iddepartment = @iddepgroup1;
            
            IF @idcountgroupdep1 IS NULL                              
            BEGIN
		
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Invalid Dept/Group'
                        ELSE statustemp + ' | Invalid Dept/Group'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END


			---------------------------------------------------
            --check groupname/department id mismatch 
            ---------------------------------------------------
            SET @idcountgroupdepmismatch1= NULL;   

            SELECT TOP 1 
            @idcountgroupdepmismatch1 = departmentcode
            FROM tbl_timekeeptemp 
            WHERE departmentcode = @iddepgroup;
            
            IF @idcountgroupdepmismatch1 IS NULL                              
            BEGIN
		
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Dept/Group Mismatch'
                        ELSE statustemp + ' | Dept/Group Mismatch'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END

	

			---------------------------------------------------
            -- Check if iddepgroup if barrrow
            ---------------------------------------------------
            SET @idcountgroupbarrow = NULL;   

            SELECT TOP 1 
                @idcountgroupbarrow = Employee_id
            FROM Employee 
            WHERE Employee_id = @employeeid1 
			              AND department_code = @iddepgroup1;
            
            IF @idcountgroupbarrow IS NULL                              
            BEGIN
		
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Barrow'
                        ELSE statustemp + ' | Barrow'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END






            ---------------------------------------------------
            -- Check if Employee ID belongs to Client
            ---------------------------------------------------
            SET @countempidemp1 = NULL;   

            SELECT TOP 1 
                @countempidemp1 = Employee_id
            FROM Employee 
            WHERE Employee_id = @employeeid1 
              AND idclient = @idclient1;
            
            IF @countempidemp1 IS NULL                              
            BEGIN
		
                UPDATE tbl_timekeeptemp
                SET statustemp =
                    CASE 
                        WHEN statustemp IS NULL OR statustemp = '' OR statustemp = 'Ok'
                            THEN 'Transfer/Oncall'
                        ELSE statustemp + ' | Transfer/Oncall'
                    END
                WHERE idtimekeeptemp = @idtimekeeptemp1;
            END


            ---------------------------------------------------
            FETCH NEXT FROM myCursor1 
            INTO @idtimekeeptemp1, @employeeid1, @idclient1, @jobcode1, @fname1,@lname1,@iddepgroup1

        END

        CLOSE myCursor1;
        DEALLOCATE myCursor1;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE 
            @ErrorMessage  NVARCHAR(4000),
            @ErrorSeverity INT,
            @ErrorState    INT;

        SELECT 
            @ErrorMessage  = ERROR_MESSAGE(),
            @ErrorSeverity = ERROR_SEVERITY(),
            @ErrorState    = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
        RETURN;

    END CATCH;
END
