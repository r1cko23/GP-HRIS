
-- =============================================
-- Author:		Pat Relos
-- Create date: 3-26-2026 8:30 pm
-- Description:for approval list 
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkforapprovelist] 
    @idclient INT, 
    @iddepartment INT,
    @datestart DATE,
    @trxtype NVARCHAR(30),
    @uname NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT        
            tk.id,
            tk.idtimekeep,
            tk.employeeid,
            tk.fname2,
            tk.lname2,

            e.lname, 
            e.fname, 
            e.lname + ', ' + e.fname 
                + ISNULL(' ' + LEFT(e.mname, 1) + '.', '') AS empname,

            tk.idclient,
			client.companyname,
            tk.idposition,
            tk.positiondesc,
            tk.dailyrate_payroll,
            tk.tkstatus,
            tk.datestart,
            tk.dateend,
            tk.payrolldate,
            
			tk.payrollyear,
            tk.payrollmonth,
			tk.payrollmonthsort,
			tk.thirteenmonthyear,


            -- removed duplicate tk.idclient
            tk.departmentcode,
            Department.Department_desc,

            tk.actualregularhours,
            tk.noofhourswork,
            tk.Overtime_Hours,
            tk.Nightdiff_Hours,
            tk.regularnightshiftOT_hours,

            tk.LegalHoliday_Hours,
			tk.LegalHoliday2_Hours,
            tk.LegalHolidayOT_Hours,
            tk.LegalHolidayND_Hours,
            tk.lhotndh,

            tk.Holiday_Special_Hours,
			tk.Holiday_Special2_Hours,
            tk.Holiday_SpecialOT_Hours,
            tk.Holiday_SpecialND_Hours,
            tk.shotndh,

            tk.rdhours,
            tk.RDothours,
            tk.rdndhours,
            tk.rdotndhours,

            tk.lhwdohours,
            tk.lhwdoothours,
            tk.lhwdondhours,
            tk.lhwdootndhours,

            tk.shwdohours,
            tk.shwdoothours,
            tk.shwdondhours,
            tk.shwdootndhours,

            tk.allowance,
			tk.incomeadjustment,
            tk.totaldeduction,

            -- FIX: add alias
            tk.uniformshortage,
            tk.nameplate,

            tk.WDOhours,

            client_branch_position.dailyratepayroll,
            client_branch_position.fixrate,

            tk.tardiness,

            -- removed duplicate tk.tkstatus

            -- RATES
            tk.regrate,
            tk.regotrate,
            tk.regndrate,
            tk.regndotrate,
            tk.lhrate,
			tk.lh2rate,
            tk.lhotrate,
            tk.lhndrate,
            tk.lhndotrate,
            tk.shrate,
			tk.sh2rate,
            tk.shotrate,
            tk.shndrate,
            tk.shndotrate,
            tk.rdrate,
            tk.rdotrate,
            tk.rdndrate,
            tk.rdndotrate,
            tk.lhwdorate,
            tk.lhwdootrate,
            tk.lhwdondrate,
            tk.lhwdondotrate,
            tk.shwdorate,
            tk.shwdootrate,
            tk.shwdondrate,
            tk.shwdondotrate,
            tk.wdorate,
            tk.lhrdotrate,
            tk.shrdotrate,

            
			 e.paythrough,
			 e.bankaccountno,
			 e.bankname,
			 e.pri_mobile,
             e.gcash,

            tk.sssbasis,    
            tk.phibasis,    
            tk.schedsss,    
            tk.idclientbranch,

            client.ytdstart,
            client.ytdend,

			client.wtaxsched,
								   
            tk.trxtype,
            tk.frequencypaymenttk,
            @uname AS uname

        FROM tbl_timekeep AS tk

        INNER JOIN GREENHRISMAIN.dbo.Employee AS e 
            ON tk.employeeid = e.Employee_id

        INNER JOIN GREENHRISMAIN.dbo.Department 
            ON tk.departmentcode = Department.iddepartment

        INNER JOIN GREENHRISMAIN.dbo.client_branch_position AS client_branch_position
            ON client_branch_position.idbranchposition = tk.idposition

        INNER JOIN GREENHRISMAIN.dbo.client AS client 
            ON tk.idclient = client.idclient

        WHERE 
            tk.idclient = @idclient
            AND tk.departmentcode = @iddepartment
            AND tk.tkstatus = 'Audited'
            AND tk.payrollstatus = 'Unprocess'
            AND tk.trxtype = @trxtype
            AND tk.datestart = @datestart
         

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
        RETURN;

    END CATCH;
END