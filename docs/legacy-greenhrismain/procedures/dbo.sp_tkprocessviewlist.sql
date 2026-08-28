
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	list if employee store in timekeep data grid 
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkprocessviewlist] 
	-- Add the parameters for the stored procedure here
			
	@idtimekeep int,
	@idemployee int, 
	@fname nvarchar(50), 
	@lname nvarchar(50), 
	@idclient 	int,
	@iddepartment int,
	@departmentdesc nvarchar(80),
	@idclientbranch int,
	@jobcode int,
	@jobdesc nvarchar(80),
	@dailyrate as float, 
	@datestart 	date, 
	@dateend 	date, 
	@payrolldate date, 
	@payrollmonth nvarchar(25),
	@payrollmonthsort int, 
	@payrollyear int, 
	@paythrough nvarchar(30),
    @bankaccountno nvarchar(30),
    @bankname nvarchar(30),
	@sssbasis nvarchar(30),
	@phibasis nvarchar(30),
	@schedsss nvarchar(30), 
	@trxtype nvarchar(30),
	@allowance float,
	@thirteenmonthyear int,
	@frequencyofpayment nvarchar(20), 
	@uname nvarchar(30) 


	/*
	@tardiness as float, 
	@totalhours as float, 
	@reg as float, 
	@regot as float, 
	@regnd as float, 
	@regotnd as float, 
    @lh as float,  
    @lhot as float, 
    @lhnd as float, 
    @lhndot as float,
	@sh as float,  
    @shot as float, 
    @shnd as float, 
    @shndot as float,
	@rd as float,  
	@rdot as float,
	@rdnd as float,  
	@rdndot as float,
	@lhwdo as float,
    @lhwdoot as float,
    @lhwdond as float, 
    @lhwdondot as float,
	@shwdo as float,
    @shwdoot as float,
    @shwdond as float, 
    @shwdondot as float,
	@totalotherincome as float,
	@totaldeduction as float,
	*/
    
                                                                               
	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error


INSERT INTO tbl_timekeep (
    idtimekeep
    ,employeeid
	,fname2
	,lname2
	,datestart
	,dateend
	,payrolldate
	,payrollmonth
	,payrollmonthsort
	,payrollyear
	,idclient
	,departmentcode
	,departmentdesc
	,idclientbranch
	,idposition
	,positiondesc
	,dailyrate_payroll
	,paythrough 
    ,bankaccountno 
    ,bankname
	,sssbasis
	,phibasis
	,schedsss
	,tkstatus
	,trxtype
	,allowance
	,thirteenmonthyear
	,frequencypaymenttk
	,createdby
	,createddate
	


	

)
VALUES (
    @idtimekeep
    ,@idemployee
	,@fname
	,@lname
	,@datestart
	,@dateend
	,@payrolldate
	,@payrollmonth
	,@payrollmonthsort
	,@payrollyear
	,@idclient
	,@iddepartment
	,@departmentdesc
	,@idclientbranch
	,@jobcode
	,@jobdesc
	,@dailyrate
	,@paythrough
    ,@bankaccountno
    ,@bankname 
	,@sssbasis
	,@phibasis
	,@schedsss
	,'Pending'
	,@trxtype
	,@allowance
	,@thirteenmonthyear
	,@frequencyofpayment
	,@uname
	,FORMAT(GETDATE(), 'MM/dd/yyyy hh:mm:ss tt')
	)
	
	




--positiondesc = client_branch_position.jobposition
--,dailyrate_payroll = client_branch_position.dailyratepayroll

--update rates 
UPDATE tk
SET
	tk.regrate = CAST(cbp.dailyratepayroll / 8.0 AS DECIMAL(18,2))
	,tk.regotrate = cbp.regularOTrate
	,tk.regndrate = cbp.nightdiffrate
	,tk.regndotrate = cbp.regularnightdiffOTrate
	
	,tk.lhrate = cbp.legalholidayrate
	,tk.lh2rate = cbp.legalholidayrate2

	,tk.lhotrate = cbp.legalholidayOTrate
	,tk.lhndrate = legalholidayNDrate
	,tk.lhndotrate = cbp.lhotndrate
	
	,tk.shrate = cbp.specialholidayrate
	,tk.sh2rate = cbp.specialholidayrate2
	,tk.shotrate= cbp.specialholidayOTrate
	,tk.shndrate = cbp.specialholidaynightdiffrate
	,tk.shndotrate = cbp.shotndrate
	
	,tk.wdorate= cbp.WDOrate
	
	,tk.rdrate= cbp.rdrate	
	,tk.rdotrate= cbp.rdotrate
	,tk.rdndrate=cbp.rdndrate
	,tk.rdndotrate = cbp.rdndotrate
	
	,tk.lhwdorate = cbp.lhwdorate
	,tk.lhwdootrate= cbp.lhwdootrate
	,tk.lhwdondrate = cbp.lhwdondrate
	,tk.lhwdondotrate = cbp.lhwdootndrate
	
	,tk.shwdorate = cbp.wdoshrate
	,tk.shwdootrate= cbp.wdoshotrate
	,tk.shwdondrate = cbp.wdoshotndrate
	,tk.shwdondotrate = cbp.wdoshotndrate
	
	
    ,tk.sourceofdata = 'Viewlist'
    ,tk.positiondesc = cbp.jobposition
	,tk.departmentdesc  = d.Department_desc
    ,tk.tkstatus     = 'Pending'
FROM tbl_timekeep AS tk
INNER JOIN [GREENHRISMAIN].dbo.Employee AS e
    ON tk.employeeid = e.Employee_id
INNER JOIN [GREENHRISMAIN].dbo.Department AS d
    ON TK.departmentcode = d.iddepartment
INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp
    ON tk.idposition = cbp.idbranchposition
WHERE employeeid = @idemployee and tk.datestart = @datestart and tk.idclient = @idclient and tk.departmentcode = @iddepartment
and trxtype= @trxtype




--update timekeeptemp as processed 
--UPDATE  tbl_timekeeptemp
--SET tkstatus = 'Processed'
--FROM    tbl_timekeeptemp
--WHERE  (tbl_timekeeptemp.idtimekeeptemp = @idtimekeep)


	
COMMIT TRANSACTION; -- Commit the transaction if everything is successful
	
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0
			ROLLBACK TRANSACTION; -- Rollback the transaction in case of an error

		-- Log or handle the error as per your requirements
		-- Example: Raising an error and returning the error message to the caller
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
		RETURN;
	END CATCH;
END
